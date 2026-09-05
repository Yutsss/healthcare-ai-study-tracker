'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Check, Clock, Loader2, Play, Target, Timer, Trash2 } from 'lucide-react';
import type { CurriculumTree } from '@/lib/curriculum';
import type { LabRouteMap } from '@/lib/lab/routes';
import type { LabExerciseReport, LabStudyLog } from '@/lib/lab/types';
import { weekDayKeys, formatMinutes } from '@/lib/week';
import { WeekChart } from '@/components/dashboard/widgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type StudyLogScreenProps = {
  mode: 'owner' | 'demo';
  routes: LabRouteMap;
  tree: CurriculumTree | null;
  logs: LabStudyLog[];
  reports: LabExerciseReport[];
  loading: boolean;
  weeklyGoal: number;
  onDelete(id: string): Promise<void>;
  onSaveWeeklyGoal(minutes: number): Promise<void>;
};

export function StudyLogScreen({ routes, tree, logs, reports, loading, weeklyGoal, onDelete, onSaveWeeklyGoal }: StudyLogScreenProps) {
  const [goalInput, setGoalInput] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekKeys = new Set(weekDayKeys());
  const weekMinutes = logs.filter((log) => weekKeys.has(log.logged_on)).reduce((sum, log) => sum + log.minutes, 0);
  const totalMinutes = logs.reduce((sum, log) => sum + log.minutes, 0);
  const moduleTitles = useMemo(() => {
    const titles = new Map<string, string>();
    for (const phase of tree?.phases || []) for (const unit of phase.units) for (const module of unit.modules) titles.set(module.id, module.title);
    return titles;
  }, [tree]);
  const grouped = useMemo(() => {
    const groups = new Map<string, LabStudyLog[]>();
    for (const log of logs) { const group = groups.get(log.logged_on) || []; group.push(log); groups.set(log.logged_on, group); }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  async function saveGoal() {
    const minutes = Number(goalInput);
    if (!Number.isFinite(minutes) || minutes < 10 || minutes > 10080) { toast.error('Goal must be between 10 and 10080 minutes'); return; }
    setBusy(true);
    try { await onSaveWeeklyGoal(minutes); toast.success('Weekly goal updated', { description: `${formatMinutes(minutes)} per week` }); setGoalInput(''); }
    catch (cause: any) { toast.error('Could not update goal', { description: cause?.message }); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try { await onDelete(id); toast('Session deleted', { description: 'Its XP was removed too.' }); }
    catch (cause: any) { toast.error('Could not delete', { description: cause?.message }); }
    finally { setBusy(false); setConfirmId(null); }
  }

  return <div className="space-y-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold tracking-tight">Study Log</h1><p className="text-sm text-muted-foreground">Sessions are recorded automatically by Focus Mode — only active focus time counts toward your streak and weekly goal.</p></div><Button asChild data-testid="log-start-focus"><Link href={routes.focus}><Play className="mr-1 h-4 w-4" /> Start focus session</Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="h-4 w-4" /> This week</p><p className="mt-2 text-3xl font-bold tabular-nums" data-testid="log-week-minutes">{formatMinutes(weekMinutes)}</p><p className="text-xs text-muted-foreground">of {formatMinutes(weeklyGoal)} goal</p></CardContent></Card><Card><CardContent className="p-5"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Total logged</p><p className="mt-2 text-3xl font-bold tabular-nums">{formatMinutes(totalMinutes)}</p><p className="text-xs text-muted-foreground">{logs.length} session{logs.length === 1 ? '' : 's'}</p></CardContent></Card><Card data-testid="goal-card"><CardContent className="space-y-2 p-5"><Label htmlFor="goal" className="flex items-center gap-2 text-sm font-normal text-muted-foreground"><Timer className="h-4 w-4" /> Weekly goal (minutes)</Label><div className="flex gap-2"><Input id="goal" data-testid="goal-input" type="number" min={10} max={10080} placeholder={String(weeklyGoal)} value={goalInput} onChange={(event) => setGoalInput(event.target.value)} /><Button onClick={() => void saveGoal()} disabled={!goalInput || busy} data-testid="goal-save">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button></div><p className="text-xs text-muted-foreground">Current: {formatMinutes(weeklyGoal)} ≈ {Math.round(weeklyGoal / 60 * 10) / 10}h / week</p></CardContent></Card></div>
    <WeekChart logs={logs} reports={reports} weeklyGoal={weeklyGoal} />
    <Card data-testid="log-history"><CardHeader className="pb-3"><CardTitle className="text-base">History</CardTitle><CardDescription>Most recent first. Deleting a session also removes the XP it earned.</CardDescription></CardHeader><CardContent className="space-y-5">{loading && <p className="text-sm text-muted-foreground">Loading…</p>}{!loading && logs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No sessions yet. Start a Focus session and it will be saved here automatically.</p>}{grouped.map(([day, items]) => <div key={day} className="space-y-1.5"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{format(parseISO(day), 'EEEE, MMM d')}</p><span className="text-xs text-muted-foreground">{formatMinutes(items.reduce((sum, log) => sum + log.minutes, 0))}</span></div>{items.map((log) => <div key={log.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2" data-testid={`log-${log.id}`}><span className="inline-flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold tabular-nums text-primary" title={log.source === 'focus' ? `Focus session · ${log.focus_intervals || 0} intervals` : 'Manual entry'}>{formatMinutes(log.minutes)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{log.topic || (log.module_id && moduleTitles.get(log.module_id)) || 'Study session'}</p>{(() => { const moduleTitle = log.module_id ? moduleTitles.get(log.module_id) : null; const parts = [moduleTitle && moduleTitle !== log.topic ? moduleTitle : null, log.notes].filter(Boolean); return parts.length ? <p className="truncate text-xs text-muted-foreground">{parts.join(' · ')}</p> : null; })()}</div>{confirmId === log.id ? <div className="flex items-center gap-1"><Button size="sm" variant="destructive" onClick={() => void remove(log.id)} disabled={busy} data-testid={`log-delete-confirm-${log.id}`}>Delete</Button><Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button></div> : <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmId(log.id)} title="Delete session" data-testid={`log-delete-${log.id}`}><Trash2 className="h-4 w-4" /></Button>}</div>)}</div>)}</CardContent></Card>
  </div>;
}
