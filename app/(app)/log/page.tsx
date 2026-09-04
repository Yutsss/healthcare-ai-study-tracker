'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Check, Clock, Loader2, Play, Target, Timer, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useDeleteStudyLog, useOwnerSettings, useStudyLogs, useUpdateWeeklyGoal } from '@/lib/hooks/useStudyLogs';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { formatMinutes } from '@/lib/week';
import { WeekChart } from '@/components/dashboard/widgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function QuickLogPage() {
  const { logs, weekMinutes, totalMinutes, sessions, isLoading } = useStudyLogs();
  const { weeklyGoal } = useOwnerSettings();
  const { reports } = useExerciseReports();
  const updateGoal = useUpdateWeeklyGoal();
  const del = useDeleteStudyLog();
  const { tree } = useCurriculumTree();
  const [goalInput, setGoalInput] = useState<string>('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const moduleTitles = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of tree?.phases || []) for (const u of p.units) for (const mod of u.modules) m.set(mod.id, mod.title);
    return m;
  }, [tree]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof logs>();
    for (const l of logs) { const arr = map.get(l.logged_on) || []; arr.push(l); map.set(l.logged_on, arr); }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  async function saveGoal() {
    const v = Number(goalInput);
    try { await updateGoal.mutateAsync(v); toast.success('Weekly goal updated', { description: `${formatMinutes(v)} per week` }); setGoalInput(''); }
    catch (e: any) { toast.error('Could not update goal', { description: e.message }); }
  }

  async function remove(id: string) {
    try { await del.mutateAsync(id); toast('Session deleted', { description: 'Its XP was removed too.' }); }
    catch (e: any) { toast.error('Could not delete', { description: e.message }); }
    finally { setConfirmId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Study Log</h1>
          <p className="text-sm text-muted-foreground">Sessions are recorded automatically by Focus Mode — only active focus time counts toward your streak and weekly goal.</p>
        </div>
        <Button asChild data-testid="log-start-focus"><Link href="/focus"><Play className="h-4 w-4 mr-1" /> Start focus session</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Target className="h-4 w-4" /> This week</p>
          <p className="mt-2 text-3xl font-bold tabular-nums" data-testid="log-week-minutes">{formatMinutes(weekMinutes)}</p>
          <p className="text-xs text-muted-foreground">of {formatMinutes(weeklyGoal)} goal</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Total logged</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatMinutes(totalMinutes)}</p>
          <p className="text-xs text-muted-foreground">{sessions} session{sessions === 1 ? '' : 's'}</p>
        </CardContent></Card>
        <Card data-testid="goal-card"><CardContent className="p-5 space-y-2">
          <Label htmlFor="goal" className="text-sm text-muted-foreground flex items-center gap-2 font-normal"><Timer className="h-4 w-4" /> Weekly goal (minutes)</Label>
          <div className="flex gap-2">
            <Input id="goal" data-testid="goal-input" type="number" min={10} max={10080} placeholder={String(weeklyGoal)} value={goalInput} onChange={(e) => setGoalInput(e.target.value)} />
            <Button onClick={saveGoal} disabled={!goalInput || updateGoal.isPending} data-testid="goal-save">{updateGoal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Current: {formatMinutes(weeklyGoal)} ≈ {Math.round(weeklyGoal / 60 * 10) / 10}h / week</p>
        </CardContent></Card>
      </div>

      <WeekChart logs={logs} reports={reports} weeklyGoal={weeklyGoal} />

      <Card data-testid="log-history">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Most recent first. Deleting a session also removes the XP it earned.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && logs.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No sessions yet. Start a Focus session (bottom-right button) and it will be saved here automatically.</p>}
          {grouped.map(([day, items]) => (
            <div key={day} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{format(parseISO(day), 'EEEE, MMM d')}</p>
                <span className="text-xs text-muted-foreground">{formatMinutes(items.reduce((s, l) => s + l.minutes, 0))}</span>
              </div>
              {items.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2" data-testid={`log-${l.id}`}>
                  <span className="inline-flex h-8 w-14 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold tabular-nums" title={l.source === 'focus' ? `Focus session · ${l.focus_intervals || 0} intervals` : 'Manual entry'}>{formatMinutes(l.minutes)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{l.topic || (l.module_id && moduleTitles.get(l.module_id)) || 'Study session'}</p>
                    {(() => {
                      const mt = l.module_id ? moduleTitles.get(l.module_id) : null;
                      const parts = [mt && mt !== l.topic ? mt : null, l.notes].filter(Boolean);
                      return parts.length ? <p className="text-xs text-muted-foreground truncate">{parts.join(' · ')}</p> : null;
                    })()}
                  </div>
                  {confirmId === l.id ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="destructive" onClick={() => remove(l.id)} disabled={del.isPending} data-testid={`log-delete-confirm-${l.id}`}>Delete</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmId(l.id)} title="Delete session" data-testid={`log-delete-${l.id}`}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
