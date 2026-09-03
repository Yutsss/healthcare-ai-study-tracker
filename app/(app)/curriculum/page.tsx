'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, BookOpenCheck, ChevronDown, ChevronRight, Download, History, Loader2, Pencil, Plus } from 'lucide-react';
import { useCurriculumRaw } from '@/lib/hooks/useCurriculum';
import { useChangeLog, useCurriculumAdmin, type EntityType, type ModuleInput, type PhaseInput, type UnitInput } from '@/lib/hooks/useCurriculumAdmin';
import type { ModuleRow, RoadmapRow, UnitRow } from '@/lib/curriculum';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type AnyInput = PhaseInput & UnitInput & ModuleInput;
type DialogState = { open: boolean; type: EntityType; mode: 'create' | 'edit'; id?: string; parentId?: string; before?: Record<string, any>; initial: AnyInput };
const bySort = <T extends { sort_order: number; title: string }>(a: T, b: T) => Number(a.sort_order) - Number(b.sort_order) || a.title.localeCompare(b.title);
const LABEL: Record<EntityType, string> = { roadmap_item: 'Phase', course_unit: 'Course', module: 'Module' };

function EntityDialog({ state, onClose, onSubmit, busy }: { state: DialogState; onClose: () => void; onSubmit: (v: AnyInput) => Promise<void>; busy: boolean }) {
  const [v, setV] = useState<AnyInput>(state.initial);
  const [err, setErr] = useState('');
  const [sig, setSig] = useState(JSON.stringify(state.initial) + state.open);
  if (sig !== JSON.stringify(state.initial) + state.open) { setSig(JSON.stringify(state.initial) + state.open); setV(state.initial); setErr(''); }
  const f = (k: keyof AnyInput, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5"><Label htmlFor={`e-${k}`}>{label}</Label><Input id={`e-${k}`} data-testid={`entity-${k}`} value={(v as any)[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} {...props} /></div>
  );
  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="entity-dialog">
        <DialogHeader>
          <DialogTitle>{state.mode === 'create' ? `New ${LABEL[state.type].toLowerCase()}` : `Edit ${LABEL[state.type].toLowerCase()}`}</DialogTitle>
          <DialogDescription>Changes are recorded in the change log and preserved across seed refreshes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {f('title', 'Title', { maxLength: 200, autoFocus: true })}
          {state.type === 'roadmap_item' && <>
            <div className="grid grid-cols-2 gap-3">{f('phase_label', 'Phase label', { placeholder: 'Phase 15 — …', maxLength: 120 })}{f('category', 'Category', { placeholder: 'e.g. Medical AI', maxLength: 80 })}</div>
            <div className="grid grid-cols-2 gap-3">{f('provider', 'Provider', { maxLength: 120 })}{f('priority', 'Priority', { placeholder: 'Required / Optional', maxLength: 40 })}</div>
            <div className="space-y-1.5"><Label htmlFor="e-tc">Target competency</Label><Textarea id="e-tc" data-testid="entity-target_competency" rows={2} value={v.target_competency ?? ''} onChange={(e) => setV({ ...v, target_competency: e.target.value })} maxLength={2000} /></div>
          </>}
          {state.type === 'module' && <div className="grid grid-cols-3 gap-3">{f('source_type', 'Type', { placeholder: 'video / lab / quiz' })}{f('xp_value', 'XP', { type: 'number', min: 1, max: 500 })}{f('estimated_minutes', 'Est. minutes', { type: 'number', min: 1 })}</div>}
          {f('source_url', 'Source URL', { type: 'url', placeholder: 'https://…' })}
          <div className="space-y-1.5"><Label htmlFor="e-desc">Description</Label><Textarea id="e-desc" data-testid="entity-description" rows={2} value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={4000} /></div>
          {err && <p role="alert" className="text-sm text-destructive" data-testid="entity-error">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button data-testid="entity-save" disabled={busy} onClick={async () => { setErr(''); try { await onSubmit(v); onClose(); } catch (e: any) { setErr(e?.message || 'Could not save'); } }}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CurriculumManagerPage() {
  const { data: raw, isLoading } = useCurriculumRaw();
  const admin = useCurriculumAdmin();
  const changeLog = useChangeLog(60);
  const [showArchived, setShowArchived] = useState(false);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({ open: false, type: 'roadmap_item', mode: 'create', initial: { title: '' } });
  const [confirm, setConfirm] = useState<{ type: EntityType; id: string; title: string; archived: boolean } | null>(null);

  const phases = useMemo(() => (raw?.roadmap || []).filter((p) => showArchived || !p.archived_at).sort(bySort), [raw, showArchived]);
  const unitsByPhase = useMemo(() => { const m = new Map<string, UnitRow[]>(); for (const u of raw?.units || []) { if (!showArchived && u.archived_at) continue; (m.get(u.roadmap_item_id) || m.set(u.roadmap_item_id, []).get(u.roadmap_item_id)!).push(u); } m.forEach((a) => a.sort(bySort)); return m; }, [raw, showArchived]);
  const modulesByUnit = useMemo(() => { const m = new Map<string, ModuleRow[]>(); for (const x of raw?.modules || []) { if (!showArchived && x.archived_at) continue; (m.get(x.course_unit_id) || m.set(x.course_unit_id, []).get(x.course_unit_id)!).push(x); } m.forEach((a) => a.sort(bySort)); return m; }, [raw, showArchived]);
  const archivedCount = useMemo(() => (raw ? raw.roadmap.filter((r) => r.archived_at).length + raw.units.filter((u) => u.archived_at).length + raw.modules.filter((m) => m.archived_at).length : 0), [raw]);
  const busy = admin.createPhase.isPending || admin.createUnit.isPending || admin.createModule.isPending || admin.update.isPending || admin.setArchived.isPending || admin.move.isPending;

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); };

  async function submitDialog(v: AnyInput) {
    const d = dialog;
    if (d.mode === 'create') {
      if (d.type === 'roadmap_item') await admin.createPhase.mutateAsync({ input: v, siblings: raw?.roadmap || [] });
      if (d.type === 'course_unit') await admin.createUnit.mutateAsync({ phaseId: d.parentId!, input: v, siblings: (raw?.units || []).filter((u) => u.roadmap_item_id === d.parentId) });
      if (d.type === 'module') await admin.createModule.mutateAsync({ unitId: d.parentId!, input: v, siblings: (raw?.modules || []).filter((m) => m.course_unit_id === d.parentId) });
      toast.success(`${LABEL[d.type]} created`);
    } else {
      await admin.update.mutateAsync({ type: d.type, id: d.id!, input: v, before: d.before! });
      toast.success(`${LABEL[d.type]} updated`);
    }
  }

  async function moveItem(type: EntityType, list: Array<{ id: string; sort_order: number; title: string }>, idx: number, dir: -1 | 1) {
    const j = idx + dir; if (j < 0 || j >= list.length) return;
    try { await admin.move.mutateAsync({ type, item: list[idx], neighbour: list[j] }); } catch (e: any) { toast.error('Could not reorder', { description: e.message }); }
  }

  function exportJson() {
    if (!raw) return;
    const payload = { exported_at: new Date().toISOString(), product: "Yuta's Lab", roadmap: raw.roadmap, course_units: raw.units, modules: raw.modules };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `yutas-lab-curriculum-${format(new Date(), 'yyyyMMdd-HHmm')}.json`; a.click(); URL.revokeObjectURL(a.href);
    toast.success('Curriculum exported');
  }

  const Actions = ({ type, item, list, idx, onAdd, addLabel }: { type: EntityType; item: RoadmapRow | UnitRow | ModuleRow; list: any[]; idx: number; onAdd?: () => void; addLabel?: string }) => (
    <div className="flex items-center gap-0.5 shrink-0">
      {onAdd && !item.archived_at && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd} data-testid={`add-${type}-${item.id}`}><Plus className="h-3.5 w-3.5 mr-1" />{addLabel}</Button>}
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Move up" disabled={idx === 0 || busy} onClick={() => moveItem(type, list, idx, -1)} data-testid={`up-${item.id}`}><ArrowUp className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Move down" disabled={idx === list.length - 1 || busy} onClick={() => moveItem(type, list, idx, 1)} data-testid={`down-${item.id}`}><ArrowDown className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => setDialog({ open: true, type, mode: 'edit', id: item.id, before: item as any, initial: { title: item.title, description: (item as any).description || '', phase_label: (item as any).phase_label || '', category: (item as any).category || '', provider: (item as any).provider || '', priority: (item as any).priority || '', access: (item as any).access || '', target_competency: (item as any).target_competency || '', source_url: (item as any).source_url || (item as any).source_urls?.[0] || '', source_type: (item as any).source_type || '', xp_value: (item as any).xp_value, estimated_minutes: (item as any).estimated_minutes || undefined } })} data-testid={`edit-${item.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
      {item.archived_at
        ? <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700" title="Restore" onClick={() => admin.setArchived.mutateAsync({ type, id: item.id, archived: false, title: item.title }).then(() => toast(`${LABEL[type]} restored`))} data-testid={`restore-${item.id}`}><ArchiveRestore className="h-3.5 w-3.5" /></Button>
        : <Button size="icon" variant="ghost" className="h-7 w-7" title="Archive" onClick={() => setConfirm({ type, id: item.id, title: item.title, archived: true })} data-testid={`archive-${item.id}`}><Archive className="h-3.5 w-3.5" /></Button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curriculum Manager</h1>
          <p className="text-sm text-muted-foreground">Add, edit, reorder, archive and restore phases, courses and modules. Archived items disappear from the roadmap but keep their progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="show-archived" /> Show archived ({archivedCount})</label>
          <Button variant="outline" size="sm" onClick={exportJson} disabled={!raw} data-testid="export-json"><Download className="h-4 w-4 mr-1" /> Export JSON</Button>
          <Button size="sm" onClick={() => setDialog({ open: true, type: 'roadmap_item', mode: 'create', initial: { title: '' } })} data-testid="new-phase"><Plus className="h-4 w-4 mr-1" /> New phase</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>}
          {phases.map((p, pi) => {
            const units = unitsByPhase.get(p.id) || [];
            const open = openPhases.has(p.id);
            return (
              <Card key={p.id} className={cn(p.archived_at && 'opacity-60 border-dashed')} data-testid={`cm-phase-${p.id}`}>
                <div className="flex items-center gap-2 p-3">
                  <button type="button" onClick={() => toggle(openPhases, p.id, setOpenPhases)} className="flex items-center gap-2 flex-1 min-w-0 text-left" data-testid={`toggle-phase-${p.id}`}>
                    {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">{pi + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.phase_label}{p.category ? ` · ${p.category}` : ''} · {units.length} courses{p.archived_at ? ' · archived' : ''}{p.manually_edited ? ' · edited' : ''}</p>
                    </div>
                  </button>
                  <Actions type="roadmap_item" item={p} list={phases} idx={pi} addLabel="Course" onAdd={() => setDialog({ open: true, type: 'course_unit', mode: 'create', parentId: p.id, initial: { title: '' } })} />
                </div>
                {open && (
                  <CardContent className="pt-0 pb-3 pl-6 space-y-1.5">
                    {units.length === 0 && <p className="text-xs text-muted-foreground py-2">No courses. Add one above.</p>}
                    {units.map((u, ui) => {
                      const mods = modulesByUnit.get(u.id) || [];
                      const uo = openUnits.has(u.id);
                      return (
                        <div key={u.id} className={cn('rounded-lg border bg-background', u.archived_at && 'opacity-60 border-dashed')} data-testid={`cm-unit-${u.id}`}>
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            <button type="button" onClick={() => toggle(openUnits, u.id, setOpenUnits)} className="flex items-center gap-2 flex-1 min-w-0 text-left" data-testid={`toggle-unit-${u.id}`}>
                              {uo ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <div className="min-w-0"><p className="text-sm truncate">{u.title}</p><p className="text-[11px] text-muted-foreground">{mods.length} modules{u.archived_at ? ' · archived' : ''}</p></div>
                            </button>
                            <Actions type="course_unit" item={u} list={units} idx={ui} addLabel="Module" onAdd={() => setDialog({ open: true, type: 'module', mode: 'create', parentId: u.id, initial: { title: '', xp_value: 20 } })} />
                          </div>
                          {uo && (
                            <div className="border-t px-2 py-1 space-y-0.5">
                              {mods.length === 0 && <p className="text-xs text-muted-foreground py-2 pl-6">No modules.</p>}
                              {mods.map((m, mi) => (
                                <div key={m.id} className={cn('flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50', m.archived_at && 'opacity-60')} data-testid={`cm-module-${m.id}`}>
                                  <span className="text-[11px] text-muted-foreground w-5 text-right tabular-nums">{mi + 1}</span>
                                  <p className="text-sm flex-1 truncate">{m.title} <span className="text-[11px] text-muted-foreground">· {m.xp_value} XP{m.archived_at ? ' · archived' : ''}</span></p>
                                  <Actions type="module" item={m} list={mods} idx={mi} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="xl:sticky xl:top-6 self-start max-h-[80vh] overflow-hidden flex flex-col" data-testid="change-log">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Change log</CardTitle><CardDescription>Every create, edit, reorder, archive and restore.</CardDescription></CardHeader>
          <CardContent className="overflow-y-auto space-y-2 text-sm">
            {changeLog.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {(changeLog.data || []).length === 0 && !changeLog.isLoading && <p className="text-muted-foreground">No changes yet.</p>}
            {(changeLog.data || []).map((c) => (
              <div key={c.id} className="rounded-md border p-2" data-testid={`log-${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={c.action === 'archive' ? 'destructive' : c.action === 'create' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">{c.action}</Badge>
                    <span className="text-[11px] text-muted-foreground">{LABEL[c.entity_type] || c.entity_type}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{format(new Date(c.created_at), 'MMM d, HH:mm')}</span>
                </div>
                <p className="mt-1 truncate">{c.after_data?.title || c.before_data?.title || '—'}</p>
                {c.action === 'update' && c.after_data && Object.keys(c.after_data).filter((k) => k !== 'title').length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate">Changed: {Object.keys(c.after_data).filter((k) => k !== 'title').join(', ')}</p>
                )}
                {c.action === 'reorder' && c.after_data?.swapped_with && <p className="text-[11px] text-muted-foreground truncate">Swapped with “{c.after_data.swapped_with}”</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <EntityDialog state={dialog} onClose={() => setDialog((d) => ({ ...d, open: false }))} onSubmit={submitDialog} busy={busy} />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive “{confirm?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>It will be hidden from the roadmap and progress totals. Nested items are hidden with it. Your progress and XP are kept, and you can restore it any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="archive-confirm" onClick={async () => { if (confirm) { try { await admin.setArchived.mutateAsync({ type: confirm.type, id: confirm.id, archived: true, title: confirm.title }); toast(`${LABEL[confirm.type]} archived`); } catch (e: any) { toast.error('Failed', { description: e.message }); } setConfirm(null); } }}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground flex items-center gap-1"><BookOpenCheck className="h-3.5 w-3.5" /> Items you create or edit are marked “edited” and are never overwritten by a seed refresh.</p>
    </div>
  );
}
