'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowLeft, ArrowRight, ExternalLink, FolderKanban, Github, Image as ImageIcon, LayoutGrid, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCreateProject, useDeleteProject, useMoveProject, useProjects, useUpdateProject, type Project, type ProjectInput, type ProjectStatus } from '@/lib/hooks/useProjects';
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
const colOf = (s: ProjectStatus): Column => (s === 'completed' ? 'completed' : s === 'in_progress' || s === 'planned' ? 'in_progress' : 'idea');

const EMPTY: ProjectInput = { title: '', description: '', project_type: '', status: 'idea', tags: [], github_url: '', demo_url: '', cover_image_url: '', is_public: false };

function ProjectDialog({ open, onOpenChange, initial, onSubmit, busy }: { open: boolean; onOpenChange: (o: boolean) => void; initial: ProjectInput; onSubmit: (v: ProjectInput) => Promise<void>; busy: boolean }) {
  const [v, setV] = useState<ProjectInput>(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [err, setErr] = useState('');
  // reset when opened with new initial
  const [key, setKey] = useState(JSON.stringify(initial));
  if (key !== JSON.stringify(initial)) { setKey(JSON.stringify(initial)); setV(initial); setTags(initial.tags.join(', ')); setErr(''); }

  async function submit() {
    setErr('');
    if (!v.title.trim()) { setErr('Title is required.'); return; }
    for (const [label, val] of [['GitHub URL', v.github_url], ['Demo URL', v.demo_url], ['Cover image URL', v.cover_image_url]] as const) {
      if (val && !safeExternalUrl(val)) { setErr(`${label} must be a valid http(s) link.`); return; }
    }
    try { await onSubmit({ ...v, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }); onOpenChange(false); }
    catch (e: any) { setErr(e?.message || 'Could not save'); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="project-dialog">
        <DialogHeader>
          <DialogTitle>{initial.title ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>Independent projects live outside the curriculum. Completing one earns 150 XP.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5"><Label htmlFor="p-title">Title</Label><Input id="p-title" data-testid="project-title" value={v.title} maxLength={200} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="p-type">Type</Label><Input id="p-type" data-testid="project-type" placeholder="e.g. Portfolio, Kaggle" value={v.project_type || ''} maxLength={100} onChange={(e) => setV({ ...v, project_type: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={v.status} onValueChange={(s) => setV({ ...v, status: s as ProjectStatus })}>
                <SelectTrigger data-testid="project-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" data-testid="project-description" rows={3} value={v.description || ''} maxLength={4000} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-tags">Skills / tags <span className="text-muted-foreground font-normal">(comma separated)</span></Label><Input id="p-tags" data-testid="project-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Python, EHR, MLOps" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="p-gh">GitHub URL</Label><Input id="p-gh" data-testid="project-github" type="url" value={v.github_url || ''} onChange={(e) => setV({ ...v, github_url: e.target.value })} placeholder="https://github.com/…" /></div>
            <div className="space-y-1.5"><Label htmlFor="p-demo">Demo URL</Label><Input id="p-demo" data-testid="project-demo" type="url" value={v.demo_url || ''} onChange={(e) => setV({ ...v, demo_url: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="p-cover">Cover image URL</Label><Input id="p-cover" data-testid="project-cover" type="url" value={v.cover_image_url || ''} onChange={(e) => setV({ ...v, cover_image_url: e.target.value })} placeholder="https://…/image.png" /></div>
          <div className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="p-public" className="font-medium">Show in public showcase</Label>
              <Switch id="p-public" checked={v.is_public} onCheckedChange={(is_public) => setV({ ...v, is_public })} data-testid="project-public" />
            </div>
            <p className="text-xs text-muted-foreground">Private by default. Turn this on only for work you want displayed publicly when your showcase is enabled.</p>
          </div>
          {err && <p role="alert" className="text-sm text-destructive" data-testid="project-error">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} data-testid="project-save">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toInput(p: Project): ProjectInput {
  return { title: p.title, description: p.description || '', project_type: p.project_type || '', status: p.status, tags: p.tags || [], github_url: p.github_url || '', demo_url: p.demo_url || '', cover_image_url: p.cover_image_url || '', is_public: p.is_public };
}

function Links({ p }: { p: Project }) {
  const gh = safeExternalUrl(p.github_url), demo = safeExternalUrl(p.demo_url);
  if (!gh && !demo) return null;
  return (
    <div className="flex gap-2">
      {gh && <a href={gh} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="GitHub"><Github className="h-4 w-4" /></a>}
      {demo && <a href={demo} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Demo"><ExternalLink className="h-4 w-4" /></a>}
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, isLoading, error } = useProjects();
  const create = useCreateProject(); const update = useUpdateProject(); const move = useMoveProject(); const del = useDeleteProject();
  const [view, setView] = useState<'board' | 'gallery'>('board');
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; project: Project | null; initial: ProjectInput }>({ open: false, project: null, initial: EMPTY });
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const active = useMemo(() => projects.filter((p) => p.status !== 'archived'), [projects]);
  const archived = useMemo(() => projects.filter((p) => p.status === 'archived'), [projects]);
  const byCol = useMemo(() => ({ idea: active.filter((p) => colOf(p.status) === 'idea'), in_progress: active.filter((p) => colOf(p.status) === 'in_progress'), completed: active.filter((p) => colOf(p.status) === 'completed') }), [active]);

  async function onSubmit(v: ProjectInput) {
    if (dialog.project) { await update.mutateAsync({ id: dialog.project.id, input: v, existing: dialog.project }); toast.success('Project updated'); }
    else { await create.mutateAsync(v); toast.success('Project created'); }
  }
  async function shift(p: Project, dir: -1 | 1) {
    const order: Column[] = ['idea', 'in_progress', 'completed'];
    const idx = order.indexOf(colOf(p.status)) + dir;
    if (idx < 0 || idx > 2) return;
    try { await move.mutateAsync({ project: p, status: order[idx] }); if (order[idx] === 'completed') toast.success(`Project completed: ${p.title}`, { description: '+150 XP' }); }
    catch (e: any) { toast.error('Could not move project', { description: e.message }); }
  }
  async function archive(p: Project, on: boolean) {
    try { await move.mutateAsync({ project: p, status: on ? 'archived' : 'idea' }); toast(on ? 'Project archived' : 'Project restored'); } catch (e: any) { toast.error('Failed', { description: e.message }); }
  }

  const CardBody = ({ p, compact }: { p: Project; compact?: boolean }) => {
    const cover = safeExternalUrl(p.cover_image_url);
    return (
      <Card className="overflow-hidden" data-testid={`project-${p.id}`}>
        {!compact && (cover ? <img src={cover} alt="" className="h-36 w-full object-cover" /> : <div className="h-24 w-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent flex items-center justify-center text-primary/40"><ImageIcon className="h-6 w-6" /></div>)}
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug">{p.title}</p>
              {p.project_type && <p className="text-[11px] text-muted-foreground">{p.project_type}</p>}
            </div>
            {p.is_public && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Public</Badge>}
            <Links p={p} />
          </div>
          {p.description && <p className="text-xs text-muted-foreground line-clamp-3">{p.description}</p>}
          {p.tags?.length > 0 && <div className="flex flex-wrap gap-1">{p.tags.slice(0, 8).map((t) => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>)}</div>}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">{p.completed_at ? `Done ${format(parseISO(p.completed_at), 'MMM d, yyyy')}` : p.started_at ? `Started ${format(parseISO(p.started_at), 'MMM d')}` : `Added ${format(new Date(p.created_at), 'MMM d')}`}</span>
            <div className="flex items-center gap-0.5">
              {p.status !== 'archived' && <>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Move left" disabled={colOf(p.status) === 'idea' || move.isPending} onClick={() => shift(p, -1)} data-testid={`project-left-${p.id}`}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Move right" disabled={colOf(p.status) === 'completed' || move.isPending} onClick={() => shift(p, 1)} data-testid={`project-right-${p.id}`}><ArrowRight className="h-3.5 w-3.5" /></Button>
              </>}
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => setDialog({ open: true, project: p, initial: toInput(p) })} data-testid={`project-edit-${p.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
              {p.status !== 'archived'
                ? <Button size="icon" variant="ghost" className="h-7 w-7" title="Archive" onClick={() => archive(p, true)} data-testid={`project-archive-${p.id}`}><Archive className="h-3.5 w-3.5" /></Button>
                : <><Button size="icon" variant="ghost" className="h-7 w-7" title="Restore" onClick={() => archive(p, false)} data-testid={`project-restore-${p.id}`}><ArchiveRestore className="h-3.5 w-3.5" /></Button>
                   <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Delete permanently" onClick={() => setConfirmDelete(p)} data-testid={`project-delete-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button></>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Independent, portfolio-worthy work outside the curriculum.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1">
            <button type="button" data-testid="view-board" onClick={() => setView('board')} className={cn('rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5', view === 'board' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}><FolderKanban className="h-4 w-4" /> Board</button>
            <button type="button" data-testid="view-gallery" onClick={() => setView('gallery')} className={cn('rounded-md px-3 py-1.5 text-sm flex items-center gap-1.5', view === 'gallery' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" /> Gallery</button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowArchived((s) => !s)} data-testid="toggle-archived">{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</Button>
          <Button onClick={() => setDialog({ open: true, project: null, initial: EMPTY })} data-testid="project-new"><Plus className="h-4 w-4 mr-1" /> New project</Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
      {error && <p className="text-sm text-destructive">Could not load projects. Please refresh.</p>}

      {view === 'board' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.key} className={cn('rounded-xl border bg-muted/30 border-t-4 p-3 space-y-3 min-h-[12rem]', c.tone)} data-testid={`column-${c.key}`}>
              <div className="flex items-center justify-between px-1">
                <div><p className="font-semibold text-sm">{c.label}</p><p className="text-[11px] text-muted-foreground">{c.hint}</p></div>
                <Badge variant="secondary">{byCol[c.key].length}</Badge>
              </div>
              {byCol[c.key].length === 0 && <p className="text-xs text-muted-foreground px-1 py-4 text-center">Nothing here yet.</p>}
              {byCol[c.key].map((p) => <CardBody key={p.id} p={p} compact />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="gallery">
          {active.length === 0 && !isLoading && <p className="text-sm text-muted-foreground col-span-full py-8 text-center">No projects yet — add your first idea.</p>}
          {active.map((p) => <CardBody key={p.id} p={p} />)}
        </div>
      )}

      {showArchived && (
        <div className="space-y-2" data-testid="archived-projects">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Archived</p>
          {archived.length === 0 && <p className="text-sm text-muted-foreground">No archived projects.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-80">{archived.map((p) => <CardBody key={p.id} p={p} compact />)}</div>
        </div>
      )}

      <ProjectDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} initial={dialog.initial} onSubmit={onSubmit} busy={create.isPending || update.isPending} />

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this project permanently?</AlertDialogTitle><AlertDialogDescription>“{confirmDelete?.title}” will be removed. This cannot be undone. XP already earned is kept.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" data-testid="project-delete-confirm" onClick={async () => { if (confirmDelete) { await del.mutateAsync(confirmDelete.id); toast('Project deleted'); setConfirmDelete(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
