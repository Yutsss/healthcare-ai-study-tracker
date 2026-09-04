'use client';

import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, ArrowRight, ExternalLink, FolderKanban, Github, Image as ImageIcon, LayoutGrid, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LabProject, LabProjectInput, LabProjectStatus } from '@/lib/lab/types';
import { safeExternalUrl } from '@/lib/security/url';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type Column = 'idea' | 'in_progress' | 'completed';
const COLUMNS: Array<{ key: Column; label: string; hint: string; tone: string }> = [
  { key: 'idea', label: 'Idea', hint: 'Backlog & sparks', tone: 'border-t-slate-400' },
  { key: 'in_progress', label: 'In Progress', hint: 'Being built', tone: 'border-t-primary' },
  { key: 'completed', label: 'Completed', hint: 'Shipped (+150 XP)', tone: 'border-t-emerald-500' },
];
const columnOf = (status: LabProjectStatus): Column => status === 'completed' ? 'completed' : status === 'in_progress' || status === 'planned' ? 'in_progress' : 'idea';
const EMPTY: LabProjectInput = { title: '', description: '', project_type: '', status: 'idea', tags: [], github_url: '', demo_url: '', cover_image_url: '', is_public: false };

export type ProjectsScreenProps = {
  mode: 'owner' | 'demo'; projects: LabProject[]; loading: boolean; error: boolean; canPublish: boolean;
  onCreate(input: LabProjectInput): Promise<void>;
  onUpdate(id: string, input: LabProjectInput, existing: LabProject): Promise<void>;
  onMove(id: string, status: LabProjectStatus, project: LabProject): Promise<void>;
  onDelete(id: string): Promise<void>;
};

function toInput(project: LabProject): LabProjectInput {
  return { title: project.title, description: project.description || '', project_type: project.project_type || '', status: project.status, tags: project.tags || [], github_url: project.github_url || '', demo_url: project.demo_url || '', cover_image_url: project.cover_image_url || '', is_public: project.is_public };
}

function ProjectDialog({ open, onOpenChange, initial, onSubmit, busy, canPublish }: { open: boolean; onOpenChange(open: boolean): void; initial: LabProjectInput; onSubmit(value: LabProjectInput): Promise<void>; busy: boolean; canPublish: boolean }) {
  const [value, setValue] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [error, setError] = useState('');
  const [key, setKey] = useState(JSON.stringify(initial));
  if (key !== JSON.stringify(initial)) { setKey(JSON.stringify(initial)); setValue(initial); setTags(initial.tags.join(', ')); setError(''); }
  async function submit() {
    setError('');
    if (!value.title.trim()) { setError('Title is required.'); return; }
    for (const [label, url] of [['GitHub URL', value.github_url], ['Demo URL', value.demo_url], ['Cover image URL', value.cover_image_url]] as const) {
      if (url && !safeExternalUrl(url)) { setError(`${label} must be a valid http(s) link.`); return; }
    }
    try {
      await onSubmit({ ...value, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), is_public: canPublish && value.is_public === true });
      onOpenChange(false);
    } catch (cause: any) { setError(cause?.message || 'Could not save'); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg" data-testid="project-dialog"><DialogHeader><DialogTitle>{initial.title ? 'Edit project' : 'New project'}</DialogTitle><DialogDescription>Independent projects live outside the curriculum. Completing one earns 150 XP.</DialogDescription></DialogHeader><div className="grid gap-3">
    <div className="space-y-1.5"><Label htmlFor="p-title">Title</Label><Input id="p-title" data-testid="project-title" value={value.title} maxLength={200} onChange={(event) => setValue({ ...value, title: event.target.value })} /></div>
    <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="p-type">Type</Label><Input id="p-type" data-testid="project-type" placeholder="e.g. Portfolio, Kaggle" value={value.project_type || ''} maxLength={100} onChange={(event) => setValue({ ...value, project_type: event.target.value })} /></div><div className="space-y-1.5"><Label>Status</Label><Select value={value.status} onValueChange={(status) => setValue({ ...value, status: status as LabProjectStatus })}><SelectTrigger data-testid="project-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="idea">Idea</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div></div>
    <div className="space-y-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" data-testid="project-description" rows={3} value={value.description || ''} maxLength={4000} onChange={(event) => setValue({ ...value, description: event.target.value })} /></div>
    <div className="space-y-1.5"><Label htmlFor="p-tags">Skills / tags <span className="font-normal text-muted-foreground">(comma separated)</span></Label><Input id="p-tags" data-testid="project-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Python, EHR, MLOps" /></div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="p-gh">GitHub URL</Label><Input id="p-gh" data-testid="project-github" type="url" value={value.github_url || ''} onChange={(event) => setValue({ ...value, github_url: event.target.value })} placeholder="https://github.com/…" /></div><div className="space-y-1.5"><Label htmlFor="p-demo">Demo URL</Label><Input id="p-demo" data-testid="project-demo" type="url" value={value.demo_url || ''} onChange={(event) => setValue({ ...value, demo_url: event.target.value })} placeholder="https://…" /></div></div>
    <div className="space-y-1.5"><Label htmlFor="p-cover">Cover image URL</Label><Input id="p-cover" data-testid="project-cover" type="url" value={value.cover_image_url || ''} onChange={(event) => setValue({ ...value, cover_image_url: event.target.value })} placeholder="https://…/image.png" /></div>
    {canPublish && <div className="space-y-1.5 rounded-lg border p-3"><div className="flex items-center justify-between gap-3"><Label htmlFor="p-public" className="font-medium">Show in public showcase</Label><Switch id="p-public" checked={value.is_public} onCheckedChange={(is_public) => setValue({ ...value, is_public })} data-testid="project-public" /></div><p className="text-xs text-muted-foreground">Private by default. Turn this on only for work you want displayed publicly when your showcase is enabled.</p></div>}
    {error && <p role="alert" className="text-sm text-destructive" data-testid="project-error">{error}</p>}
  </div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button><Button onClick={() => void submit()} disabled={busy} data-testid="project-save">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save</Button></DialogFooter></DialogContent></Dialog>;
}

function ProjectLinks({ project }: { project: LabProject }) {
  const github = safeExternalUrl(project.github_url), demo = safeExternalUrl(project.demo_url);
  if (!github && !demo) return null;
  return <div className="flex gap-2">{github && <a href={github} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="GitHub"><Github className="h-4 w-4" /></a>}{demo && <a href={demo} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Demo"><ExternalLink className="h-4 w-4" /></a>}</div>;
}

export function ProjectsScreen({ projects, loading, error, canPublish, onCreate, onUpdate, onMove, onDelete }: ProjectsScreenProps) {
  const [view, setView] = useState<'board' | 'gallery'>('board');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; project: LabProject | null; initial: LabProjectInput }>({ open: false, project: null, initial: EMPTY });
  const [confirmDelete, setConfirmDelete] = useState<LabProject | null>(null);
  const active = useMemo(() => projects.filter((project) => project.status !== 'archived'), [projects]);
  const archived = useMemo(() => projects.filter((project) => project.status === 'archived'), [projects]);
  const byColumn = useMemo(() => ({ idea: active.filter((project) => columnOf(project.status) === 'idea'), in_progress: active.filter((project) => columnOf(project.status) === 'in_progress'), completed: active.filter((project) => columnOf(project.status) === 'completed') }), [active]);

  async function submit(input: LabProjectInput) { setBusy(true); try { if (dialog.project) { await onUpdate(dialog.project.id, input, dialog.project); toast.success('Project updated'); } else { await onCreate(input); toast.success('Project created'); } } finally { setBusy(false); } }
  async function move(project: LabProject, status: LabProjectStatus) { setBusy(true); try { await onMove(project.id, status, project); if (status === 'completed') toast.success(`Project completed: ${project.title}`, { description: '+150 XP' }); } catch (cause: any) { toast.error('Could not move project', { description: cause?.message }); } finally { setBusy(false); } }
  async function shift(project: LabProject, direction: -1 | 1) { const order: Column[] = ['idea', 'in_progress', 'completed']; const next = order[order.indexOf(columnOf(project.status)) + direction]; if (next) await move(project, next); }

  const ProjectCard = ({ project, compact }: { project: LabProject; compact?: boolean }) => {
    const cover = safeExternalUrl(project.cover_image_url);
    return <Card className="overflow-hidden" data-testid={`project-${project.id}`}>{!compact && (cover ? <img src={cover} alt="" className="h-36 w-full object-cover" /> : <div className="flex h-24 w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/5 to-transparent text-primary/40"><ImageIcon className="h-6 w-6" /></div>)}<CardContent className="space-y-2 p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-snug">{project.title}</p>{project.project_type && <p className="text-[11px] text-muted-foreground">{project.project_type}</p>}</div>{canPublish && project.is_public && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Public</Badge>}<ProjectLinks project={project} /></div>{project.description && <p className="line-clamp-3 text-xs text-muted-foreground">{project.description}</p>}{project.tags.length > 0 && <div className="flex flex-wrap gap-1">{project.tags.slice(0, 8).map((tag) => <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-[10px]">{tag}</Badge>)}</div>}<div className="flex items-center justify-between pt-1"><span className="text-[11px] text-muted-foreground">{project.completed_at ? `Done ${format(parseISO(project.completed_at), 'MMM d, yyyy')}` : project.started_at ? `Started ${format(parseISO(project.started_at), 'MMM d')}` : project.created_at ? `Added ${format(new Date(project.created_at), 'MMM d')}` : 'Starter project'}</span><div className="flex items-center gap-0.5">{project.status !== 'archived' && <><Button size="icon" variant="ghost" className="h-7 w-7" title="Move left" disabled={columnOf(project.status) === 'idea' || busy} onClick={() => void shift(project, -1)} data-testid={`project-left-${project.id}`}><ArrowLeft className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" title="Move right" disabled={columnOf(project.status) === 'completed' || busy} onClick={() => void shift(project, 1)} data-testid={`project-right-${project.id}`}><ArrowRight className="h-3.5 w-3.5" /></Button></>}<Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => setDialog({ open: true, project, initial: toInput(project) })} data-testid={`project-edit-${project.id}`}><Pencil className="h-3.5 w-3.5" /></Button>{project.status !== 'archived' ? <Button size="icon" variant="ghost" className="h-7 w-7" title="Archive" onClick={() => void move(project, 'archived')} data-testid={`project-archive-${project.id}`}><Archive className="h-3.5 w-3.5" /></Button> : <><Button size="icon" variant="ghost" className="h-7 w-7" title="Restore" onClick={() => void move(project, 'idea')} data-testid={`project-restore-${project.id}`}><ArchiveRestore className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete permanently" onClick={() => setConfirmDelete(project)} data-testid={`project-delete-${project.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div></div></CardContent></Card>;
  };

  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Projects</h1><p className="text-sm text-muted-foreground">Independent, portfolio-worthy work outside the curriculum.</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg bg-muted p-1"><button type="button" data-testid="view-board" onClick={() => setView('board')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', view === 'board' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}><FolderKanban className="h-4 w-4" /> Board</button><button type="button" data-testid="view-gallery" onClick={() => setView('gallery')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', view === 'gallery' ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" /> Gallery</button></div><Button variant="outline" size="sm" onClick={() => setShowArchived((value) => !value)} data-testid="toggle-archived">{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</Button><Button onClick={() => setDialog({ open: true, project: null, initial: EMPTY })} data-testid="project-new"><Plus className="mr-1 h-4 w-4" /> New project</Button></div></div>
    {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}{error && <p className="text-sm text-destructive">Could not load projects. Please refresh.</p>}
    {view === 'board' ? <div className="grid gap-4 md:grid-cols-3">{COLUMNS.map((column) => <div key={column.key} className={cn('min-h-[12rem] space-y-3 rounded-xl border border-t-4 bg-muted/30 p-3', column.tone)} data-testid={`column-${column.key}`}><div className="flex items-center justify-between px-1"><div><p className="text-sm font-semibold">{column.label}</p><p className="text-[11px] text-muted-foreground">{column.hint}</p></div><Badge variant="secondary">{byColumn[column.key].length}</Badge></div>{byColumn[column.key].length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground">Nothing here yet.</p>}{byColumn[column.key].map((project) => <ProjectCard key={project.id} project={project} compact />)}</div>)}</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="gallery">{active.length === 0 && !loading && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No projects yet — add your first idea.</p>}{active.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
    {showArchived && <div className="space-y-2" data-testid="archived-projects"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Archived</p>{archived.length === 0 && <p className="text-sm text-muted-foreground">No archived projects.</p>}<div className="grid gap-3 opacity-80 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{archived.map((project) => <ProjectCard key={project.id} project={project} compact />)}</div></div>}
    <ProjectDialog open={dialog.open} onOpenChange={(open) => setDialog((current) => ({ ...current, open }))} initial={dialog.initial} onSubmit={submit} busy={busy} canPublish={canPublish} />
    <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this project permanently?</AlertDialogTitle><AlertDialogDescription>“{confirmDelete?.title}” will be removed. This cannot be undone. XP already earned is kept.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" data-testid="project-delete-confirm" onClick={async () => { if (!confirmDelete) return; await onDelete(confirmDelete.id); toast('Project deleted'); setConfirmDelete(null); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
